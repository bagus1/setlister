




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
			\fill-line { \larger "Caravan" }
			\fill-line {
				"Lyrics by Irving Mills"
				"Music by Duke Ellington, Juan Tizol"
			}
			\fill-line {
				"Bright Latin and Swing"
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

	\myMark "A"
	%\mark "Bright Latin"
	\startPart
	\repeat volta 2 {
		c1*4:7 | \myEndLine
		c1*4:7 | \myEndLine
		c1*4:7 | \myEndLine
		f1*4:m6 | \myEndLine
	}
	% so I would see the repeat marks
	%\endPart

	\myMark "B"
	%\mark "Swing"
	\startPart
	f1*4:9 | \myEndLine
	bes1*4:9 | \myEndLine
	ees1*4:7 | \myEndLine
	aes1*2:6 | c1*2:7 | \myEndLine
	\endPart

	\myMark "A"
	%\mark "Bright Latin"
	\startPart
	c1*4:7 | \myEndLine
	c1*4:7 | \myEndLine
	c1*4:7 | \myEndLine
	f1*4:m6 | \myEndLine
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
	\tempo "Prestissimo" 4 = 220
	\time 2/2
	\key f \minor

	% part "A"
	\repeat volta 2 {
		c'1~ | c~ | c4 des c g | bes c e g, |
		bes1~ | bes~ | bes4 c des c | des c b g |
		bes!1~ | bes~ | bes4 c b bes | a aes g ges |
		f1~ | f~ | f | r |
	}

	% part "B"
	f'1 | d2 c4. g8~ | g1~ | g4. f8 e4-. f-. |
	c'1 | g2 f4. c8~ | c1 | r2 bes'8 c des d |
	ees1 | c2 bes4. f8~ | f1~ | f2 g4-. ees-. |
	c'4. aes8~ aes2~ | aes bes4-. aes-. | g2 g4. g8~ | g2 r |

	% part "A"
	c1~ | c~ | c4 des c g | bes c e g, |
	bes1~ | bes~ | bes4 c des c | des c b g |
	bes!1~ | bes~ | bes4 c b bes | a aes g ges |
	f1~ | f~ | f | r |
}




 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	






% these lyrics are from the Ella Firtgerald performance and adjusted for this tune...
\lyricmode {

	% part "A"
	Night __ and stars that shine ab -- ove so bright __
	The ma -- gic of their fa -- ding light __
	That shines u -- pon our Ca -- ra -- van __

	% part "B"
	You are so exciting, __ _ _ _
	This is so inviting __ _ _ _ _
	Res -- ting in my_arms __
	As I thrill to the magic charms __ _ _

	% part "A"
	Of_you be -- side me here, be -- neath the blue __
	My dream of love is com -- ing true __
	With -- in our de -- sert Ca -- ra -- van __
}


}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	







\lyricmode {

	% part "A"
	Sleep __ u -- pon my shou -- lder as we creep __
	Ac -- ross the sand so I may keep __
	This mem -- 'ry of our Ca -- ra -- van __
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

	\myMark "A"
	%\mark "Bright Latin"
	\startPart
	\repeat volta 2 {
		c1*4:7 | \myEndLine
		c1*4:7 | \myEndLine
		c1*4:7 | \myEndLine
		f1*4:m6 | \myEndLine
	}
	% so I would see the repeat marks
	%\endPart

	\myMark "B"
	%\mark "Swing"
	\startPart
	f1*4:9 | \myEndLine
	bes1*4:9 | \myEndLine
	ees1*4:7 | \myEndLine
	aes1*2:6 | c1*2:7 | \myEndLine
	\endPart

	\myMark "A"
	%\mark "Bright Latin"
	\startPart
	c1*4:7 | \myEndLine
	c1*4:7 | \myEndLine
	c1*4:7 | \myEndLine
	f1*4:m6 | \myEndLine
	\endPart

	\endSong
	\endChords
}






\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Prestissimo" 4 = 220
	\time 2/2
	\key f \minor

	% part "A"
	\repeat volta 2 {
		c'1~ | c~ | c4 des c g | bes c e g, |
		bes1~ | bes~ | bes4 c des c | des c b g |
		bes!1~ | bes~ | bes4 c b bes | a aes g ges |
		f1~ | f~ | f | r |
	}

	% part "B"
	f'1 | d2 c4. g8~ | g1~ | g4. f8 e4-. f-. |
	c'1 | g2 f4. c8~ | c1 | r2 bes'8 c des d |
	ees1 | c2 bes4. f8~ | f1~ | f2 g4-. ees-. |
	c'4. aes8~ aes2~ | aes bes4-. aes-. | g2 g4. g8~ | g2 r |

	% part "A"
	c1~ | c~ | c4 des c g | bes c e g, |
	bes1~ | bes~ | bes4 c des c | des c b g |
	bes!1~ | bes~ | bes4 c b bes | a aes g ges |
	f1~ | f~ | f | r |
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
		\smaller \smaller { "Copyright © 1937 (renewed 1965) Mills Music c/o EMI Music Publishing" }
	}
	\fill-line {
		\smaller \smaller { "Used by Permission of CPP/Belwin, Inc., Miami, FL ALL Right Reserved" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:09 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





