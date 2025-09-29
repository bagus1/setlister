




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts








% this causes the variables to be defined...












% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "My Ship" }
			\fill-line { \large \smaller \bold \larger "From The Musical Production 'Lady In The Dark'" }
			\fill-line {
				"Lyrics by Ira Gershwin"
				"Music by Kurt Weil"
			}
			\fill-line {
				"Moderately Slow"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startChords
	\startSong
	\partial 4 s4

	\repeat volta 2 {

		\myMark "A"
		\startPart
		f2 d:7 | g:m7 c:7 | f d:7 | g:m7 c:7 | \myEndLine
		f d:7 | g:m a:7 | d:m7 g:7 | g:m7 c:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		f2 d:7 | g:m7 c:7 | f d:7 | g:m7 c:7 | \myEndLine
		f d:7 | g:m a:7 | d:m g:m7 | f d:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g:m7 c:7 | g:m7 c:7 | g:m7 c:7 | f e:7 | \myEndLine
		a:m d:m7 | a:m d:m7 | g:7 g:dim7 | g:7 c:9 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		f2 d:7 | g:m7 c:7 | f d:7 | g:m7 c:7 | \myEndLine
		f d:7 | g:m a:7 |
	} \alternative {
		{
			d:m g4.:m7 c8:7 | f2. c4:7 | \myEndLineVoltaNotLast
		}
		{
			d2:m c:7 | f c:7 | \myEndLine
			f d:m | bes c:7 | f d:m7 | g:m7.5- c:7 | f des:7 | f1 | \myEndLineVoltaLast
		}
	}
	\endPart

	\endSong
	\endChords
}


}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Moderato" 4 = 100
	\time 4/4
	\key f \major

	\partial 4 c4 |

	\repeat volta 2 {

		% part "A"
		d f c' a8 c | a4 d, d r8 c | d4 f c' c | d,2. c8 cis |
		d4 f d' c8 d | c4 bes a e8 f | g1~ | g2. c,4 |

		% part "A"
		d f c' a8 c | a4 d, d4. c8 | d4 f c' c | d,2. r8 c |
		d4 f d' c8 d | c4 bes a e8 f | g2 g | f2 r4 a8 c |

		% part "B"
		bes4 a g4. c8 | bes4 a g2 | d'4 bes g f | a2. b!8 d |
		c4 b! a r8 d | c4 b! a b8 c | d4 b! g e | d2. c4 |

		% part "A"
		d f c' a8 c | a4 d, d4. c8 | d4 f c' c | d,2. c8 cis |
		d4 f d' c8 d | c4 bes a4. g8 |
	} \alternative {
		{
			f4. f8 d'4. e,8 | f2 r4 c |
		}
		{
			f4. f8 g4. g8 | a2. c8 c | b!4 c f e8 f | e4 d c bes | c2 f | f, g | f1~ | f4 r r2 |
		}
	}
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	My Ship has sails that are made of silk,
	the decks are trimmed with gold.
	And of jam and spice there's a par -- a -- dise in the hold. __

	% part "A"
	My Ship's a -- glow with a mil -- lion pearls and ru -- bies fill each bin;
	the sun sits high in a sap -- phire sky when my ship comes in.

	% part "B"
	I can wait the years 'til it ap -- pears one fine day one spring,
	but the pearls and such the won't mean much if there's miss -- ing just one thing.

	% part "A"
	I do not care if that day ar -- rives, that dream need nev -- er be,
	if the ship I sing does -- n't al -- so bring my own true love to me.

	% part "ending"
	My own true love to me,
	if the ship I sing does -- n't al -- so bring my own true love to me. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startChords
	\startSong
	\partial 4 s4

	\repeat volta 2 {

		\myMark "A"
		\startPart
		f2 d:7 | g:m7 c:7 | f d:7 | g:m7 c:7 | \myEndLine
		f d:7 | g:m a:7 | d:m7 g:7 | g:m7 c:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		f2 d:7 | g:m7 c:7 | f d:7 | g:m7 c:7 | \myEndLine
		f d:7 | g:m a:7 | d:m g:m7 | f d:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g:m7 c:7 | g:m7 c:7 | g:m7 c:7 | f e:7 | \myEndLine
		a:m d:m7 | a:m d:m7 | g:7 g:dim7 | g:7 c:9 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		f2 d:7 | g:m7 c:7 | f d:7 | g:m7 c:7 | \myEndLine
		f d:7 | g:m a:7 |
	} \alternative {
		{
			d:m g4.:m7 c8:7 | f2. c4:7 | \myEndLineVoltaNotLast
		}
		{
			d2:m c:7 | f c:7 | \myEndLine
			f d:m | bes c:7 | f d:m7 | g:m7.5- c:7 | f des:7 | f1 | \myEndLineVoltaLast
		}
	}
	\endPart

	\endSong
	\endChords
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Moderato" 4 = 100
	\time 4/4
	\key f \major

	\partial 4 c4 |

	\repeat volta 2 {

		% part "A"
		d f c' a8 c | a4 d, d r8 c | d4 f c' c | d,2. c8 cis |
		d4 f d' c8 d | c4 bes a e8 f | g1~ | g2. c,4 |

		% part "A"
		d f c' a8 c | a4 d, d4. c8 | d4 f c' c | d,2. r8 c |
		d4 f d' c8 d | c4 bes a e8 f | g2 g | f2 r4 a8 c |

		% part "B"
		bes4 a g4. c8 | bes4 a g2 | d'4 bes g f | a2. b!8 d |
		c4 b! a r8 d | c4 b! a b8 c | d4 b! g e | d2. c4 |

		% part "A"
		d f c' a8 c | a4 d, d4. c8 | d4 f c' c | d,2. c8 cis |
		d4 f d' c8 d | c4 bes a4. g8 |
	} \alternative {
		{
			f4. f8 d'4. e,8 | f2 r4 c |
		}
		{
			f4. f8 g4. g8 | a2. c8 c | b!4 c f e8 f | e4 d c bes | c2 f | f, g | f1~ | f4 r r2 |
		}
	}
}


}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1941 and renewed 1969 Hampshire House Publishing Corp. and Chappell & Co., Inc., New York, NY" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:09 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





