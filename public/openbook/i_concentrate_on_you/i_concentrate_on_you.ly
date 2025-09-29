




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
			\fill-line { \larger "I Concentrate On You" }
			\fill-line {
				""
				"Lyrics and Music by Cole Porter"
			}
			\fill-line {
				"Slowly"
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

	\repeat volta 2 {

		\myMark "A"
		\startPart
		ees1:6 | ees:maj7 | bes1*2:7 | ees1:m7 | des2:m7 ges:9 | ces1:6 | aes2:m7 aes:m7/ges | \myEndLine
		f1:m7.5- | bes:7 | ees:m6 | c:m7.5- | f:7 | bes:7 | ees:6 | f2:m7 bes:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		ees1:6 | ees:maj7 | bes1*2:7 | ees1:m7 | des2:m7 ges:9 | ces1:6 | ces2:6 ces/bes | \myEndLine
		aes1:m7 | des:7 | ges:maj7 | b:maj7 | f:7 | bes:7 | ees2:6 aes:6 | ees ees:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		aes1:maj7 | aes:m7 | ees | g2:m7 c:7 | f1:m7 | bes:7 | ees:maj7 | ees:7 | \myEndLine
		aes:maj7 | des:7 | ges2:maj7 ges/f | ees:m7 ees:m/des | c1:m7.5- | f:7 | bes2 bes:maj7 | bes1:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		ees | ees:maj7 | a:m7.5- | d:7 | bes:m7 | ees2:7 aes:maj7 | d1:m7.5- | g:7 | \myEndLine
		g:m7.5- | c:7.5+ | f:m | fis:dim7 | f:7.5-/ces | bes:7 |
	} \alternative {
		{
			ees | f2:m7 bes:7 | \myEndLineVoltaNotLast
		}
		{
			ees2:6 aes:6 | ees1:6 | f1*2:m7 | bes1:7.9- | bes2:7.9- e:9 | ees1*4:6.9 | \myEndLineVoltaLast
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
	\tempo "Allegro" 4 = 130
	\time 2/2
	\key ees \major

	\repeat volta 2 {

		% part "A"
		r4 bes c ees | d2. c4 | d4. d8 d2~ | d2. r4 | r ees \tuplet 3/2 { ges aes bes } | aes2. ges4 | aes1~ | aes2. r4 |
		r aes \tuplet 3/2 { aes bes ces } | bes a aes2 | r4 aes ges f | ges1 | r4 f aes g | ges f2 ees4~ | ees1~ | ees2. r4 |

		% part "A"
		r bes c ees | d2. c4 | d4. d8 d2~ | d2. r4 | r ees \tuplet 3/2 { ges aes bes } | aes2. ges4 | aes1~ | aes2. r4 |
		r aes \tuplet 3/2 { ces des ees } | des c! ces2 | r4 b bes a | bes1 | r4 f aes g | ges f2 ees4~ | ees1~ | ees4 r ees ees |

		% part "B"
		c'2. c4 | b2. b4 | b2 bes2~ | bes bes,4. bes8 | aes'2. aes4 | aes2 g4. fis8 | g1~ | g2 ees4. ees8 |
		c'2 c4 c | ces2 \tuplet 3/2 { ces4 des ces } | ces2 bes~ | bes4 bes bes bes | bes2. bes4 | c2. bes8 c | d1~ | d2. r4 |

		% part "A"
		r ees ees ees | d2. bes4 | c4. c8 c2~ | c2. r4 | r c b c | bes!2 \tuplet 3/2 { bes,4 c ees } | g1~ | g2. r4 |
		r g bes a | aes!2. g4 | g f e4. f8 | c'1 | r4 f, aes g | ges f2 ees4~ |
	} \alternative {
		{
			ees1~ | ees2. r4 |
		}
		{
			ees1~ | ees2 ees | f4. f8 f2~ | f f | g4. g8 g2~ | g bes | bes1~ | bes~ | bes4 r r2 | r1 |
		}
	}
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	When -- ev -- er skies look grey to me __
	and trou -- ble be -- gins to brew, __
	when -- ev -- er the win -- ter winds be -- come too strong,
	I Con -- cen -- trate On You. __

	% part "A"
	When for -- tune cries "\"nay," "nay!\"" to me __
	and peo -- ple de -- clare "\"You're" "through,\"" __
	when -- ev -- er the blues be -- come my on -- ly song,
	I Con -- cen -- trate On You. __

	% part "B"
	On your smile so sweet, so ten -- der, __
	when at first my kiss you de -- cline. __
	On the light in your eyes,
	when you sur -- ren -- der __ and once a -- gain our arms in -- ter -- twine. __

	% part "A"
	And so when wise -- men say to me __
	that love's young dream nev -- er comes true. __
	To prove that e -- ven wise -- men can be wrong,
	I Con -- cen -- trate On You. __
	_ I con -- cen -- trate, __ and con -- cen -- trate __ on you. __
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

	\repeat volta 2 {

		\myMark "A"
		\startPart
		ees1:6 | ees:maj7 | bes1*2:7 | ees1:m7 | des2:m7 ges:9 | ces1:6 | aes2:m7 aes:m7/ges | \myEndLine
		f1:m7.5- | bes:7 | ees:m6 | c:m7.5- | f:7 | bes:7 | ees:6 | f2:m7 bes:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		ees1:6 | ees:maj7 | bes1*2:7 | ees1:m7 | des2:m7 ges:9 | ces1:6 | ces2:6 ces/bes | \myEndLine
		aes1:m7 | des:7 | ges:maj7 | b:maj7 | f:7 | bes:7 | ees2:6 aes:6 | ees ees:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		aes1:maj7 | aes:m7 | ees | g2:m7 c:7 | f1:m7 | bes:7 | ees:maj7 | ees:7 | \myEndLine
		aes:maj7 | des:7 | ges2:maj7 ges/f | ees:m7 ees:m/des | c1:m7.5- | f:7 | bes2 bes:maj7 | bes1:7 | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		ees | ees:maj7 | a:m7.5- | d:7 | bes:m7 | ees2:7 aes:maj7 | d1:m7.5- | g:7 | \myEndLine
		g:m7.5- | c:7.5+ | f:m | fis:dim7 | f:7.5-/ces | bes:7 |
	} \alternative {
		{
			ees | f2:m7 bes:7 | \myEndLineVoltaNotLast
		}
		{
			ees2:6 aes:6 | ees1:6 | f1*2:m7 | bes1:7.9- | bes2:7.9- e:9 | ees1*4:6.9 | \myEndLineVoltaLast
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
	\tempo "Allegro" 4 = 130
	\time 2/2
	\key ees \major

	\repeat volta 2 {

		% part "A"
		r4 bes c ees | d2. c4 | d4. d8 d2~ | d2. r4 | r ees \tuplet 3/2 { ges aes bes } | aes2. ges4 | aes1~ | aes2. r4 |
		r aes \tuplet 3/2 { aes bes ces } | bes a aes2 | r4 aes ges f | ges1 | r4 f aes g | ges f2 ees4~ | ees1~ | ees2. r4 |

		% part "A"
		r bes c ees | d2. c4 | d4. d8 d2~ | d2. r4 | r ees \tuplet 3/2 { ges aes bes } | aes2. ges4 | aes1~ | aes2. r4 |
		r aes \tuplet 3/2 { ces des ees } | des c! ces2 | r4 b bes a | bes1 | r4 f aes g | ges f2 ees4~ | ees1~ | ees4 r ees ees |

		% part "B"
		c'2. c4 | b2. b4 | b2 bes2~ | bes bes,4. bes8 | aes'2. aes4 | aes2 g4. fis8 | g1~ | g2 ees4. ees8 |
		c'2 c4 c | ces2 \tuplet 3/2 { ces4 des ces } | ces2 bes~ | bes4 bes bes bes | bes2. bes4 | c2. bes8 c | d1~ | d2. r4 |

		% part "A"
		r ees ees ees | d2. bes4 | c4. c8 c2~ | c2. r4 | r c b c | bes!2 \tuplet 3/2 { bes,4 c ees } | g1~ | g2. r4 |
		r g bes a | aes!2. g4 | g f e4. f8 | c'1 | r4 f, aes g | ges f2 ees4~ |
	} \alternative {
		{
			ees1~ | ees2. r4 |
		}
		{
			ees1~ | ees2 ees | f4. f8 f2~ | f f | g4. g8 g2~ | g bes | bes1~ | bes~ | bes4 r r2 | r1 |
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
		\smaller \smaller { "Copyright © 1939 by Chappell & Co., Inc." }
	}
	\fill-line {
		\smaller \smaller { "Copyright Renenwed, Assigned to John F. Wharton, Trustee of the Cole Porter Musical & Literary Propery Trusts" }
	}
	\fill-line {
		\smaller \smaller { "Chappell & Co., Inc. owner of publication and allied rights throughout the World." }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:15 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





